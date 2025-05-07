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
  data: userGroupSchema,
});

export const copyUserGroup = createTool({
  id: "copy-user-group",
  description: "ユーザーグループをコピー",
  inputSchema: z.object({
    userGroupId: z.number(),
    group: z.string(),
    copyMembers: z.number().optional(),
    copyFeatures: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/group/${context.userGroupId}/copy`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("group", context.group);
    if (context.copyMembers) formData.append("copyMembers", context.copyMembers.toString());
    if (context.copyFeatures) formData.append("copyFeatures", context.copyFeatures.toString());

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
    console.log("User group copied successfully");
    return validatedData;
  },
});

export default copyUserGroup; 