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

export const assignUserToGroup = createTool({
  id: "assign-user-to-group",
  description: "ユーザーをユーザーグループに割り当て",
  inputSchema: z.object({
    userGroupId: z.number(),
    userId: z.array(z.number()),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/group/members/assign/${context.userGroupId}`);
    
    // フォームデータの作成
    const formData = new FormData();
    context.userId.forEach(id => {
      formData.append("userId[]", id.toString());
    });

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
    console.log("Users assigned to group successfully");
    return validatedData;
  },
});

export default assignUserToGroup; 