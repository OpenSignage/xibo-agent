import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.instanceof(Blob),
});

export const downloadPlayerVersion = createTool({
  id: "download-player-version",
  description: "プレイヤーバージョンファイルをダウンロード",
  inputSchema: z.object({
    versionId: z.number(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/playersoftware/download/${context.versionId}`);
    
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    console.log("Player version downloaded successfully");
    return {
      success: true,
      data: blob
    };
  },
});

export default downloadPlayerVersion; 