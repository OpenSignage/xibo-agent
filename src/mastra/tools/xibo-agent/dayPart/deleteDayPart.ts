import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const deleteDayPart = createTool({
  id: "delete-daypart",
  description: "デイパートを削除",
  inputSchema: z.object({
    dayPartId: z.number(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/daypart/${context.dayPartId}`);
    
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("DayPart deleted successfully");
    return {
      success: true,
      data: null
    };
  },
});

export default deleteDayPart; 