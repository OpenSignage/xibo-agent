import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";
import { dataSetDataSchema } from "./schemas";

export const getDataSetData = createTool({
  id: "get-data-set-data",
  description: "データセットのデータを取得",
  inputSchema: z.object({
    dataSetId: z.number(),
  }),
  outputSchema: z.array(dataSetDataSchema),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset/${context.dataSetId}/data`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data set data retrieved successfully");
    return data;
  },
}); 