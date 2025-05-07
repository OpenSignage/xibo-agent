import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const dayPartSchema = z.object({
  dayPartId: z.number(),
  isAlways: z.number(),
  isCustom: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  exceptionDays: z.array(z.string()).optional(),
  exceptionStartTimes: z.array(z.string()).optional(),
  exceptionEndTimes: z.array(z.string()).optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(dayPartSchema),
});

export const getDayParts = createTool({
  id: "get-dayparts",
  description: "デイパートを検索",
  inputSchema: z.object({
    dayPartId: z.number().optional(),
    name: z.string().optional(),
    embed: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/daypart`);
    
    // クエリパラメータの追加
    if (context.dayPartId) url.searchParams.append("dayPartId", context.dayPartId.toString());
    if (context.name) url.searchParams.append("name", context.name);
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
    console.log("DayParts retrieved successfully");
    return validatedData;
  },
});

export default getDayParts; 