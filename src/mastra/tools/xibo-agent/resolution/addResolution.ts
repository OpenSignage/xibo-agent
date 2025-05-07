import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const addResolution = createTool({
  id: "add-resolution",
  description: "新しい解像度の追加",
  inputSchema: z.object({
    resolution: z.string(),
    width: z.number(),
    height: z.number(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/resolution`);
    const formData = new FormData();
    formData.append("resolution", context.resolution);
    formData.append("width", context.width.toString());
    formData.append("height", context.height.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Resolution added successfully");
    return JSON.stringify(data);
  },
}); 