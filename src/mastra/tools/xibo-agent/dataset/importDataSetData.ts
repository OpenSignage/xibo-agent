import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { apiResponseSchema } from "./schemas";

export const importDataSetData = createTool({
  id: "import-data-set-data",
  description: "データセットにデータをインポート",
  inputSchema: z.object({
    dataSetId: z.number(),
    file: z.string(),
    overwrite: z.boolean().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset/${context.dataSetId}/import`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    formData.append("file", context.file);
    if (context.overwrite !== undefined) {
      formData.append("overwrite", context.overwrite.toString());
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data set data imported successfully");
    return data;
  },
}); 