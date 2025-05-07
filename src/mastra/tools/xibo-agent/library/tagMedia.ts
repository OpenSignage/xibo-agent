import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const tagMedia = createTool({
  id: "tag-media",
  description: "メディアへのタグ付け",
  inputSchema: z.object({
    mediaId: z.number(),
    tags: z.array(z.string()),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/library/${context.mediaId}/tag`);
    const formData = new FormData();
    context.tags.forEach(tag => {
      formData.append("tag[]", tag);
    });

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
    console.log("Media tagged successfully");
    return JSON.stringify(data);
  },
}); 