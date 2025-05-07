import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const statisticsDataSchema = z.object({
  statId: z.number(),
  type: z.string(),
  statDate: z.string(),
  displayId: z.number(),
  layoutId: z.number().optional(),
  mediaId: z.number().optional(),
  campaignId: z.number().optional(),
  duration: z.number(),
  count: z.number(),
  display: z.string(),
  layout: z.string().optional(),
  media: z.string().optional(),
  campaign: z.string().optional(),
  tags: z.string().optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(statisticsDataSchema),
});

export const getStats = createTool({
  id: "get-stats",
  description: "統計データを検索",
  inputSchema: z.object({
    type: z.enum(["Layout", "Media", "Widget"]).optional(),
    fromDt: z.string().optional(),
    toDt: z.string().optional(),
    statDate: z.string().optional(),
    statId: z.string().optional(),
    displayId: z.number().optional(),
    displayIds: z.array(z.number()).optional(),
    layoutId: z.array(z.number()).optional(),
    parentCampaignId: z.number().optional(),
    mediaId: z.array(z.number()).optional(),
    campaignId: z.number().optional(),
    returnDisplayLocalTime: z.boolean().optional(),
    returnDateFormat: z.string().optional(),
    embed: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/stats`);
    
    // クエリパラメータの追加
    if (context.type) url.searchParams.append("type", context.type);
    if (context.fromDt) url.searchParams.append("fromDt", context.fromDt);
    if (context.toDt) url.searchParams.append("toDt", context.toDt);
    if (context.statDate) url.searchParams.append("statDate", context.statDate);
    if (context.statId) url.searchParams.append("statId", context.statId);
    if (context.displayId) url.searchParams.append("displayId", context.displayId.toString());
    if (context.displayIds) url.searchParams.append("displayIds", context.displayIds.join(","));
    if (context.layoutId) url.searchParams.append("layoutId", context.layoutId.join(","));
    if (context.parentCampaignId) url.searchParams.append("parentCampaignId", context.parentCampaignId.toString());
    if (context.mediaId) url.searchParams.append("mediaId", context.mediaId.join(","));
    if (context.campaignId) url.searchParams.append("campaignId", context.campaignId.toString());
    if (context.returnDisplayLocalTime) url.searchParams.append("returnDisplayLocalTime", context.returnDisplayLocalTime.toString());
    if (context.returnDateFormat) url.searchParams.append("returnDateFormat", context.returnDateFormat);
    if (context.embed) url.searchParams.append("embed", context.embed);

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
    console.log("Statistics retrieved successfully");
    return validatedData;
  },
});

export default getStats; 