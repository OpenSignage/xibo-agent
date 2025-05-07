import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const addDisplayProfile = createTool({
  id: "add-display-profile",
  description: "ディスプレイプロファイルの追加",
  inputSchema: z.object({
    name: z.string(),
    type: z.string(),
    isDefault: z.number(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displayprofile`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    formData.append("name", context.name);
    formData.append("type", context.type);
    formData.append("isDefault", context.isDefault.toString());

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Display profile added successfully");
    return JSON.stringify(data);
  },
}); 