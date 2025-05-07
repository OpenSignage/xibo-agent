import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const deleteMedia = createTool({
  id: "delete-media",
  description: "メディアの削除",
  inputSchema: z.object({
    mediaId: z.number(),
    forceDelete: z.number(),
    purge: z.number().optional(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/library/${context.mediaId}`);
    const formData = new FormData();
    formData.append("forceDelete", context.forceDelete.toString());
    if (context.purge) formData.append("purge", context.purge.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Media deleted successfully");
    return "Media deleted successfully";
  },
}); 