import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const userOptionSchema = z.object({
  option: z.string(),
  value: z.string(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(userOptionSchema),
});

export const getUserPreferences = createTool({
  id: "get-user-preferences",
  description: "Gets user preferences.",
  inputSchema: z.object({
    preference: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/user/pref`);
    if (context.preference) url.searchParams.append("preference", context.preference);
    
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
    console.log("User preferences retrieved successfully");
    return validatedData;
  },
});

export default getUserPreferences; 