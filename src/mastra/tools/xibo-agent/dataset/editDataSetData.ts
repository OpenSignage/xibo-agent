import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";
import { dataSetDataSchema, apiResponseSchema } from "./schemas";

export const editDataSetData = createTool({
  id: "edit-data-set-data",
  description: "データセットのデータを編集",
  inputSchema: z.object({
    dataSetId: z.number(),
    rowId: z.number(),
    rowData: z.record(z.string(), z.any()),
  }),
  outputSchema: apiResponseSchema.extend({
    data: dataSetDataSchema,
  }),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset/${context.dataSetId}/data/${context.rowId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    Object.entries(context.rowData).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data set data edited successfully");
    return data;
  },
}); 