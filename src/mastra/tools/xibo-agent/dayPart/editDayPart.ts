import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

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
  data: dayPartSchema,
});

export const editDayPart = createTool({
  id: "edit-daypart",
  description: "デイパートを編集",
  inputSchema: z.object({
    dayPartId: z.number(),
    name: z.string(),
    description: z.string().optional(),
    startTime: z.string(),
    endTime: z.string(),
    exceptionDays: z.array(z.string()).optional(),
    exceptionStartTimes: z.array(z.string()).optional(),
    exceptionEndTimes: z.array(z.string()).optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/daypart/${context.dayPartId}`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("name", context.name);
    formData.append("startTime", context.startTime);
    formData.append("endTime", context.endTime);
    if (context.description) formData.append("description", context.description);
    if (context.exceptionDays) {
      context.exceptionDays.forEach(day => formData.append("exceptionDays[]", day));
    }
    if (context.exceptionStartTimes) {
      context.exceptionStartTimes.forEach(time => formData.append("exceptionStartTimes[]", time));
    }
    if (context.exceptionEndTimes) {
      context.exceptionEndTimes.forEach(time => formData.append("exceptionEndTimes[]", time));
    }

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("DayPart edited successfully");
    return validatedData;
  },
});

export default editDayPart; 