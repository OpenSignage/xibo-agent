import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const getLibrary = createTool({
  id: "get-library",
  description: "ライブラリの検索",
  inputSchema: z.object({
    mediaId: z.number().optional(),
    media: z.string().optional(),
    type: z.string().optional(),
    ownerId: z.number().optional(),
    retired: z.number().optional(),
    tags: z.string().optional(),
    folderId: z.number().optional(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/library`);
    if (context.mediaId) url.searchParams.append("mediaId", context.mediaId.toString());
    if (context.media) url.searchParams.append("media", context.media);
    if (context.type) url.searchParams.append("type", context.type);
    if (context.ownerId) url.searchParams.append("ownerId", context.ownerId.toString());
    if (context.retired) url.searchParams.append("retired", context.retired.toString());
    if (context.tags) url.searchParams.append("tags", context.tags);
    if (context.folderId) url.searchParams.append("folderId", context.folderId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Library search successful");
    return JSON.stringify(data);
  },
}); 