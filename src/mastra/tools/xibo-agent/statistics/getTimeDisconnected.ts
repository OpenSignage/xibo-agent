import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const timeDisconnectedSchema = z.object({
  displayId: z.number(),
  display: z.string(),
  timeDisconnected: z.number(),
  tags: z.string().optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(timeDisconnectedSchema),
});

export const getTimeDisconnected = createTool({
  id: "get-time-disconnected",
  description: "切断時間の統計を取得",
  inputSchema: z.object({
    fromDt: z.string(),
    toDt: z.string(),
    displayId: z.number().optional(),
    displayIds: z.array(z.number()).optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/stats/timeDisconnected`);
    
    // クエリパラメータの追加
    url.searchParams.append("fromDt", context.fromDt);
    url.searchParams.append("toDt", context.toDt);
    if (context.displayId) url.searchParams.append("displayId", context.displayId.toString());
    if (context.displayIds) url.searchParams.append("displayIds", context.displayIds.join(","));

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Time disconnected stats retrieved successfully");
    return validatedData;
  },
});

export default getTimeDisconnected; 