import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";
import { dataSetColumnSchema, apiResponseSchema } from "./schemas";

export const editDataSetColumn = createTool({
  id: "edit-data-set-column",
  description: "データセットのカラムを編集",
  inputSchema: z.object({
    dataSetId: z.number(),
    dataSetColumnId: z.number(),
    heading: z.string(),
    dataTypeId: z.number(),
    listContent: z.string().optional(),
    columnOrder: z.number().optional(),
    formula: z.string().optional(),
    remoteField: z.string().optional(),
    showFilter: z.boolean().optional(),
    showSort: z.boolean().optional(),
  }),
  outputSchema: apiResponseSchema.extend({
    data: dataSetColumnSchema,
  }),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset/${context.dataSetId}/column/${context.dataSetColumnId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    Object.entries(context).forEach(([key, value]) => {
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
    console.log("Data set column edited successfully");
    return data;
  },
}); 