import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const fontDetailsSchema = z.object({
  details: z.array(z.any()),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: fontDetailsSchema,
});

export const getFontDetails = createTool({
  id: "get-font-details",
  description: "フォントの詳細を取得",
  inputSchema: z.object({
    id: z.number(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/fonts/details/${context.id}`);
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
    console.log("Font details retrieved successfully");
    return validatedData;
  },
});

export default getFontDetails; 