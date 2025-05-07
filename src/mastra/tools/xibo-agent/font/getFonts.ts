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
  data: z.array(fontSchema),
});

export const getFonts = createTool({
  id: "get-fonts",
  description: "フォントを検索",
  inputSchema: z.object({
    id: z.number().optional(),
    name: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/fonts`);
    
    // クエリパラメータの追加
    if (context.id) url.searchParams.append("id", context.id.toString());
    if (context.name) url.searchParams.append("name", context.name);

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
    console.log("Fonts retrieved successfully");
    return validatedData;
  },
});

export default getFonts; 