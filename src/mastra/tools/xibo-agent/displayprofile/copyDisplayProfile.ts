import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const copyDisplayProfile = createTool({
  id: "copy-display-profile",
  description: "ディスプレイプロファイルのコピー",
  inputSchema: z.object({
    displayProfileId: z.number(),
    name: z.string(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displayprofile/${context.displayProfileId}/copy`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    formData.append("name", context.name);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Display profile copied successfully");
    return JSON.stringify(data);
  },
}); 