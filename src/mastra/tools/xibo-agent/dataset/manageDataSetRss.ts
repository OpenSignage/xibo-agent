import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any(),
});

const rssSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  cacheTimeout: z.number().optional(),
  lastSync: z.string().optional(),
  lastSyncStatus: z.number().optional(),
  lastSyncMessage: z.string().optional(),
});

export const manageDataSetRss = createTool({
  id: "manage-data-set-rss",
  description: "データセットのRSSフィードを管理",
  inputSchema: z.object({
    dataSetId: z.number(),
    rssId: z.number().optional(),
    action: z.enum(["get", "add", "edit", "delete"]),
    data: rssSchema.optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    let url: URL;
    let method: string;
    let body: string | undefined;

    switch (context.action) {
      case "get":
        url = new URL(`${config.cmsUrl}/dataset/${context.dataSetId}/rss`);
        method = "GET";
        break;
      case "add":
        url = new URL(`${config.cmsUrl}/dataset/${context.dataSetId}/rss`);
        method = "POST";
        body = JSON.stringify(context.data);
        break;
      case "edit":
        if (!context.rssId) throw new Error("RSS ID is required for edit action");
        url = new URL(`${config.cmsUrl}/dataset/${context.dataSetId}/rss/${context.rssId}`);
        method = "PUT";
        body = JSON.stringify(context.data);
        break;
      case "delete":
        if (!context.rssId) throw new Error("RSS ID is required for delete action");
        url = new URL(`${config.cmsUrl}/dataset/${context.dataSetId}/rss/${context.rssId}`);
        method = "DELETE";
        break;
      default:
        throw new Error("Invalid action");
    }

    console.log(`Requesting URL: ${url.toString()}`);

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
    console.log(`RSS feed ${context.action} operation completed successfully`);
    return {
      success: true,
      data: data
    };
  },
});

export default manageDataSetRss; 