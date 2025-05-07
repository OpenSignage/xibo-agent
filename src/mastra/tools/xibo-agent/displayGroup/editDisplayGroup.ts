import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const editDisplayGroup = createTool({
  id: "edit-display-group",
  description: "ディスプレイグループの編集",
  inputSchema: z.object({
    displayGroupId: z.number(),
    displayGroup: z.string(),
    description: z.string().optional(),
    isDynamic: z.boolean().optional(),
    dynamicCriteria: z.string().optional(),
    folderId: z.number().optional(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displaygroup/${context.displayGroupId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    formData.append("displayGroup", context.displayGroup);
    if (context.description) formData.append("description", context.description);
    if (context.isDynamic !== undefined) formData.append("isDynamic", context.isDynamic.toString());
    if (context.dynamicCriteria) formData.append("dynamicCriteria", context.dynamicCriteria);
    if (context.folderId) formData.append("folderId", context.folderId.toString());

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Display group edited successfully");
    return JSON.stringify(data);
  },
}); 