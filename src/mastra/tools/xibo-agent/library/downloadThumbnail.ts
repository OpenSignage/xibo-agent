import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const downloadThumbnail = createTool({
  id: "download-thumbnail",
  description: "サムネイルのダウンロード",
  inputSchema: z.object({
    mediaId: z.number(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/library/thumbnail/${context.mediaId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.blob();
    console.log("Thumbnail downloaded successfully");
    return URL.createObjectURL(data);
  },
}); 