import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const selectFolder = createTool({
  id: "select-folder",
  description: "フォルダの選択",
  inputSchema: z.object({
    displayGroupId: z.number(),
    folderId: z.number(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displaygroup/${context.displayGroupId}/folder`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    formData.append("folderId", context.folderId.toString());

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Folder selected successfully");
    return JSON.stringify(data);
  },
}); 