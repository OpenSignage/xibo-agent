import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const setDefaultLayout = createTool({
  id: "set-default-layout",
  description: "デフォルトレイアウトの設定",
  inputSchema: z.object({
    displayId: z.number(),
    layoutId: z.number(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/display/defaultlayout/${context.displayId}`);
    const formData = new FormData();
    formData.append("layoutId", context.layoutId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Default layout set successfully");
    return "Default layout set successfully";
  },
}); 