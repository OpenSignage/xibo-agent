import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const checkLicence = createTool({
  id: "check-licence",
  description: "ライセンスの確認",
  inputSchema: z.object({
    displayId: z.number(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/display/licenceCheck/${context.displayId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Licence check requested successfully");
    return "Licence check requested successfully";
  },
}); 