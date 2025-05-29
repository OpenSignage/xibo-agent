import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.number(),
});

export const getExportStatsCount = createTool({
  id: "get-export-stats-count",
  description: "統計データのエクスポート数を取得",
  inputSchema: z.object({
    fromDt: z.string().optional(),
    toDt: z.string().optional(),
    displayId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/stats/getExportStatsCount`);
    
    // クエリパラメータの追加
    if (context.fromDt) url.searchParams.append("fromDt", context.fromDt);
    if (context.toDt) url.searchParams.append("toDt", context.toDt);
    if (context.displayId) url.searchParams.append("displayId", context.displayId.toString());

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
    console.log("Export stats count retrieved successfully");
    return validatedData;
  },
});

export default getExportStatsCount; 