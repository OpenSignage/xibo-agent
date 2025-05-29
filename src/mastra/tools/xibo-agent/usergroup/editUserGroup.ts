import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

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

export const editUserGroup = createTool({
  id: "edit-user-group",
  description: "ユーザーグループを編集",
  inputSchema: z.object({
    userGroupId: z.number(),
    group: z.string(),
    description: z.string().optional(),
    libraryQuota: z.string().optional(),
    isSystemNotification: z.number().optional(),
    isDisplayNotification: z.number().optional(),
    isScheduleNotification: z.number().optional(),
    isCustomNotification: z.number().optional(),
    isShownForAddUser: z.number().optional(),
    defaultHomePageId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/group/${context.userGroupId}`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("group", context.group);
    if (context.description) formData.append("description", context.description);
    if (context.libraryQuota) formData.append("libraryQuota", context.libraryQuota);
    if (context.isSystemNotification) formData.append("isSystemNotification", context.isSystemNotification.toString());
    if (context.isDisplayNotification) formData.append("isDisplayNotification", context.isDisplayNotification.toString());
    if (context.isScheduleNotification) formData.append("isScheduleNotification", context.isScheduleNotification.toString());
    if (context.isCustomNotification) formData.append("isCustomNotification", context.isCustomNotification.toString());
    if (context.isShownForAddUser) formData.append("isShownForAddUser", context.isShownForAddUser.toString());
    if (context.defaultHomePageId) formData.append("defaultHomePageId", context.defaultHomePageId.toString());

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
    console.log("User group edited successfully");
    return validatedData;
  },
});

export default editUserGroup; 