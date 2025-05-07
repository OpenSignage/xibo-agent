import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const userGroupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  description: z.string().optional(),
  libraryQuota: z.number().optional(),
  isSystemNotification: z.number().optional(),
  isDisplayNotification: z.number().optional(),
  isScheduleNotification: z.number().optional(),
  isCustomNotification: z.number().optional(),
  isShownForAddUser: z.number().optional(),
  defaultHomePageId: z.number().optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(userGroupSchema),
});

export const getUserGroups = createTool({
  id: "get-user-groups",
  description: "ユーザーグループを検索",
  inputSchema: z.object({
    userGroupId: z.number().optional(),
    userGroup: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/group`);
    
    // クエリパラメータの追加
    if (context.userGroupId) url.searchParams.append("userGroupId", context.userGroupId.toString());
    if (context.userGroup) url.searchParams.append("userGroup", context.userGroup);

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
    console.log("User groups retrieved successfully");
    return validatedData;
  },
});

export default getUserGroups; 