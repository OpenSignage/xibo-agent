import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const editMedia = createTool({
  id: "edit-media",
  description: "メディアの編集",
  inputSchema: z.object({
    mediaId: z.number(),
    name: z.string(),
    duration: z.number(),
    retired: z.number(),
    tags: z.string().optional(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/library/${context.mediaId}`);
    const formData = new FormData();
    formData.append("name", context.name);
    formData.append("duration", context.duration.toString());
    formData.append("retired", context.retired.toString());
    if (context.tags) formData.append("tags", context.tags);

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Media edited successfully");
    return JSON.stringify(data);
  },
}); 