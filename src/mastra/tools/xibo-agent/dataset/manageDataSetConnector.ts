import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any(),
});

const connectorSchema = z.object({
  name: z.string(),
  type: z.string(),
  config: z.record(z.any()),
  isActive: z.boolean().optional(),
  lastSync: z.string().optional(),
  lastSyncStatus: z.number().optional(),
  lastSyncMessage: z.string().optional(),
});

export const manageDataSetConnector = createTool({
  id: "manage-data-set-connector",
  description: "データセットのデータコネクターを管理",
  inputSchema: z.object({
    dataSetId: z.number(),
    action: z.enum(["get", "add", "edit", "delete"]),
    data: connectorSchema.optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset/dataConnector/${context.dataSetId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    let method: string;
    let body: string | undefined;

    switch (context.action) {
      case "get":
        method = "GET";
        break;
      case "add":
        method = "POST";
        body = JSON.stringify(context.data);
        break;
      case "edit":
        method = "PUT";
        body = JSON.stringify(context.data);
        break;
      case "delete":
        method = "DELETE";
        break;
      default:
        throw new Error("Invalid action");
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        ...await getAuthHeaders(),
        ...(body && { "Content-Type": "application/json" }),
      },
      ...(body && { body }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Data connector ${context.action} operation completed successfully`);
    return {
      success: true,
      data: data
    };
  },
});

export default manageDataSetConnector; 