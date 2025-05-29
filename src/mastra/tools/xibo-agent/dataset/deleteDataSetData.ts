import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { apiResponseSchema } from "./schemas";

export const deleteDataSetData = createTool({
  id: "delete-data-set-data",
  description: "データセットのデータを削除",
  inputSchema: z.object({
    dataSetId: z.number(),
    rowId: z.number(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset/${context.dataSetId}/data/${context.rowId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data set data deleted successfully");
    return data;
  },
}); 