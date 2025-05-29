import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

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
  data: displayVenueSchema,
});

export const addDisplayVenue = createTool({
  id: "add-display-venue",
  description: "新しい会場を追加",
  inputSchema: z.object({
    name: z.string(),
    address: z.string().optional(),
    isMobile: z.number().optional(),
    isOutdoor: z.number().optional(),
    languages: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displayvenue/add`);
    const formData = new FormData();
    
    formData.append("name", context.name);
    if (context.address) formData.append("address", context.address);
    if (context.isMobile) formData.append("isMobile", context.isMobile.toString());
    if (context.isOutdoor) formData.append("isOutdoor", context.isOutdoor.toString());
    if (context.languages) formData.append("languages", context.languages);
    if (context.latitude) formData.append("latitude", context.latitude.toString());
    if (context.longitude) formData.append("longitude", context.longitude.toString());

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
    console.log("Display venue added successfully");
    return validatedData;
  },
});

export default addDisplayVenue; 