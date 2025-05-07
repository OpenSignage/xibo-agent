import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const displayVenueSchema = z.object({
  venueId: z.number(),
  name: z.string(),
  address: z.string().nullable(),
  isMobile: z.number(),
  isOutdoor: z.number(),
  languages: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(displayVenueSchema),
});

export const getDisplayVenues = createTool({
  id: "get-display-venues",
  description: "会場を検索",
  inputSchema: z.object({}),
  outputSchema: apiResponseSchema,
  execute: async () => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displayvenue`);
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
    console.log("Display venues retrieved successfully");
    return validatedData;
  },
});

export default getDisplayVenues; 