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
  data: z.array(actionSchema),
});

export const getActions = createTool({
  id: "get-actions",
  description: "アクションを検索",
  inputSchema: z.object({
    actionId: z.number().optional(),
    ownerId: z.number().optional(),
    triggerType: z.string().optional(),
    triggerCode: z.string().optional(),
    actionType: z.string().optional(),
    source: z.string().optional(),
    sourceId: z.number().optional(),
    target: z.string().optional(),
    targetId: z.number().optional(),
    layoutId: z.number().optional(),
    sourceOrTargetId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/action`);
    
    // クエリパラメータの追加
    if (context.actionId) url.searchParams.append("actionId", context.actionId.toString());
    if (context.ownerId) url.searchParams.append("ownerId", context.ownerId.toString());
    if (context.triggerType) url.searchParams.append("triggerType", context.triggerType);
    if (context.triggerCode) url.searchParams.append("triggerCode", context.triggerCode);
    if (context.actionType) url.searchParams.append("actionType", context.actionType);
    if (context.source) url.searchParams.append("source", context.source);
    if (context.sourceId) url.searchParams.append("sourceId", context.sourceId.toString());
    if (context.target) url.searchParams.append("target", context.target);
    if (context.targetId) url.searchParams.append("targetId", context.targetId.toString());
    if (context.layoutId) url.searchParams.append("layoutId", context.layoutId.toString());
    if (context.sourceOrTargetId) url.searchParams.append("sourceOrTargetId", context.sourceOrTargetId.toString());

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
    console.log("Actions retrieved successfully");
    return validatedData;
  },
});

export default getActions; 