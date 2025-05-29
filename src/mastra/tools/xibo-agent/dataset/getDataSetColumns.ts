import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetColumnSchema } from "./schemas";

export const getDataSetColumns = createTool({
  id: "get-data-set-columns",
  description: "データセットのカラム一覧を取得",
  inputSchema: z.object({
    dataSetId: z.number(),
  }),
  outputSchema: z.array(dataSetColumnSchema),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset/${context.dataSetId}/column`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data set columns retrieved successfully");
    return data;
  },
}); 