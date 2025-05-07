import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const deleteCommand = createTool({
  id: "delete-command",
  description: "コマンドを削除",
  inputSchema: z.object({
    commandId: z.number(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/command/${context.commandId}`);
    
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Command deleted successfully");
    return {
      success: true,
      data: null
    };
  },
});

export default deleteCommand; 