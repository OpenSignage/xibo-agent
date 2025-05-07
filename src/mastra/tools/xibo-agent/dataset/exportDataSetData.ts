import { z } from 'zod';
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";
import { apiResponseSchema } from "./schemas";

export const exportDataSetData = createTool({
  id: "export-data-set-data",
  description: "データセットのデータをCSVでエクスポート",
  inputSchema: z.object({
    dataSetId: z.number(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset/export/csv/${context.dataSetId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    console.log("Data set data exported successfully");
    return {
      success: true,
      data: data
    };
  },
});

export default exportDataSetData; 