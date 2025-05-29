import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const actionSchema = z.object({
  actionId: z.number(),
  ownerId: z.number(),
  triggerType: z.string(),
  triggerCode: z.string().optional(),
  actionType: z.string(),
  source: z.string(),
  sourceId: z.number(),
  target: z.string(),
  targetId: z.number().optional(),
  widgetId: z.number().optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: actionSchema,
});

export const addAction = createTool({
  id: "add-action",
  description: "アクションを追加",
  inputSchema: z.object({
    layoutId: z.number(),
    actionType: z.string(),
    target: z.string(),
    triggerType: z.string(),
    triggerCode: z.string().optional(),
    sourceId: z.number().optional(),
    targetId: z.number().optional(),
    widgetId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/action`);
    const formData = new FormData();
    
    // 必須パラメータ
    formData.append("layoutId", context.layoutId.toString());
    formData.append("actionType", context.actionType);
    formData.append("target", context.target);
    formData.append("triggerType", context.triggerType);
    
    // オプションパラメータ
    if (context.triggerCode) formData.append("triggerCode", context.triggerCode);
    if (context.sourceId) formData.append("sourceId", context.sourceId.toString());
    if (context.targetId) formData.append("targetId", context.targetId.toString());
    if (context.widgetId) formData.append("widgetId", context.widgetId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Action added successfully");
    return validatedData;
  },
});

export default addAction; 