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
  data: z.null(),
});

export const setUserPreferences = createTool({
  id: "set-user-preferences",
  description: "Sets user preferences.",
  inputSchema: z.object({
    preferences: z.array(userOptionSchema),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/user/pref`);
    
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(context.preferences),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("User preferences set successfully");
    return {
      success: true,
      data: null
    };
  },
});

export default setUserPreferences; 