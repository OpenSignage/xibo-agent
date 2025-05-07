import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const getResolutions = createTool({
  id: "get-resolutions",
  description: "解像度の検索",
  inputSchema: z.object({
    resolutionId: z.number().optional(),
    resolution: z.string().optional(),
    partialResolution: z.string().optional(),
    enabled: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/resolution`);
    if (context.resolutionId) url.searchParams.append("resolutionId", context.resolutionId.toString());
    if (context.resolution) url.searchParams.append("resolution", context.resolution);
    if (context.partialResolution) url.searchParams.append("partialResolution", context.partialResolution);
    if (context.enabled) url.searchParams.append("enabled", context.enabled.toString());
    if (context.width) url.searchParams.append("width", context.width.toString());
    if (context.height) url.searchParams.append("height", context.height.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Resolution search successful");
    return JSON.stringify(data);
  },
}); 