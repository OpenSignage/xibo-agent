import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { apiResponseSchema } from "./schemas";

const importJsonSchema = z.object({
  uniqueKeys: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.any())),
});

export const importDataSetDataJson = createTool({
  id: "import-data-set-data-json",
  description: "データセットにJSONデータをインポート",
  inputSchema: z.object({
    dataSetId: z.number(),
    data: importJsonSchema,
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset/importjson/${context.dataSetId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...await getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(context.data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data set data imported successfully");
    return {
      success: true,
      data: data
    };
  },
});

export default importDataSetDataJson; 