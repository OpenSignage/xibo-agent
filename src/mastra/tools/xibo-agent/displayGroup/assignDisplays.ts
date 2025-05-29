import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const assignDisplays = createTool({
  id: "assign-displays",
  description: "ディスプレイの割り当て",
  inputSchema: z.object({
    displayGroupId: z.number(),
    displayIds: z.array(z.number()),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displaygroup/${context.displayGroupId}/display/assign`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    context.displayIds.forEach((displayId) => {
      formData.append("displayIds[]", displayId.toString());
    });

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Displays assigned successfully");
    return JSON.stringify(data);
  },
}); 