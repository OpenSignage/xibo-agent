import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetSchema, apiResponseSchema } from "./schemas";

export const addDataSet = createTool({
  id: "add-data-set",
  description: "データセットを追加",
  inputSchema: z.object({
    dataSet: z.string(),
    description: z.string().optional(),
    code: z.string().optional(),
    isRemote: z.boolean().optional(),
    method: z.string().optional(),
    uri: z.string().optional(),
    postData: z.string().optional(),
    authentication: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    refreshRate: z.number().optional(),
    clearRate: z.number().optional(),
    runsAfter: z.string().optional(),
    dataRoot: z.string().optional(),
    lastSync: z.string().optional(),
    isProcessed: z.boolean().optional(),
    remoteUrl: z.string().optional(),
    settings: z.string().optional(),
  }),
  outputSchema: apiResponseSchema.extend({
    data: dataSetSchema,
  }),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data set added successfully");
    return data;
  },
}); 