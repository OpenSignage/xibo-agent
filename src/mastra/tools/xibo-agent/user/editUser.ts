import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const userSchema = z.object({
  userId: z.number(),
  userName: z.string(),
  email: z.string().optional(),
  userTypeId: z.number(),
  homePageId: z.number(),
  libraryQuota: z.number().optional(),
  isSystemNotification: z.number().optional(),
  isDisplayNotification: z.number().optional(),
  isScheduleNotification: z.number().optional(),
  isCustomNotification: z.number().optional(),
  isShownForAddUser: z.number().optional(),
  defaultHomePageId: z.number().optional(),
  retired: z.number().optional(),
  tags: z.string().optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: userSchema,
});

export const editUser = createTool({
  id: "edit-user",
  description: "ユーザーを編集",
  inputSchema: z.object({
    userId: z.number(),
    userName: z.string(),
    email: z.string().optional(),
    userTypeId: z.number(),
    homePageId: z.number(),
    libraryQuota: z.number().optional(),
    newPassword: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/user/${context.userId}`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("userName", context.userName);
    if (context.email) formData.append("email", context.email);
    formData.append("userTypeId", context.userTypeId.toString());
    formData.append("homePageId", context.homePageId.toString());
    if (context.libraryQuota) formData.append("libraryQuota", context.libraryQuota.toString());
    if (context.newPassword) formData.append("newPassword", context.newPassword);

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
    console.log("User edited successfully");
    return validatedData;
  },
});

export default editUser; 