import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const addMedia = createTool({
  id: "add-media",
  description: "メディアの追加",
  inputSchema: z.object({
    name: z.string(),
    type: z.string(),
    duration: z.number(),
    tags: z.string().optional(),
    folderId: z.number().optional(),
    enableStat: z.string().optional(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/library`);
    const formData = new FormData();
    formData.append("name", context.name);
    formData.append("type", context.type);
    formData.append("duration", context.duration.toString());
    if (context.tags) formData.append("tags", context.tags);
    if (context.folderId) formData.append("folderId", context.folderId.toString());
    if (context.enableStat) formData.append("enableStat", context.enableStat);

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
    console.log("Media added successfully");
    return JSON.stringify(data);
  },
}); 