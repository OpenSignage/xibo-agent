import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const groupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  isUserSpecific: z.number(),
  isEveryone: z.number(),
  description: z.string().nullable(),
  libraryQuota: z.number(),
  isSystemNotification: z.number(),
  isDisplayNotification: z.number(),
  isDataSetNotification: z.number(),
  isLayoutNotification: z.number(),
  isLibraryNotification: z.number(),
  isReportNotification: z.number(),
  isScheduleNotification: z.number(),
  isCustomNotification: z.number(),
  isShownForAddUser: z.number(),
  defaultHomepageId: z.string().nullable(),
  features: z.array(z.string()),
  buttons: z.array(z.unknown()),
});

const userResponseSchema = z.array(z.object({
  userId: z.number(),
  userName: z.string(),
  userTypeId: z.number(),
  loggedIn: z.number(),
  email: z.string().nullable(),
  homePageId: z.string(),
  homeFolderId: z.number(),
  lastAccessed: z.string().nullable(),
  newUserWizard: z.number(),
  retired: z.number(),
  isPasswordChangeRequired: z.number(),
  groupId: z.number(),
  group: z.string(),
  libraryQuota: z.number(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
  ref1: z.string().nullable(),
  ref2: z.string().nullable(),
  ref3: z.string().nullable(),
  ref4: z.string().nullable(),
  ref5: z.string().nullable(),
  groups: z.array(groupSchema),
  campaigns: z.array(z.unknown()),
  layouts: z.array(z.unknown()),
  media: z.array(z.unknown()),
  events: z.array(z.unknown()),
  playlists: z.array(z.unknown()),
  displayGroups: z.array(z.unknown()),
  dayParts: z.array(z.unknown()),
  isSystemNotification: z.number(),
  isDisplayNotification: z.number(),
  isDataSetNotification: z.number(),
  isLayoutNotification: z.number(),
  isLibraryNotification: z.number(),
  isReportNotification: z.number(),
  isScheduleNotification: z.number(),
  isCustomNotification: z.number(),
  twoFactorTypeId: z.number(),
  homeFolder: z.string(),
}));

export const getUsers = createTool({
  id: 'get-users',
  description: 'Xiboのユーザー一覧を取得します',
  inputSchema: z.object({}),
  outputSchema: z.string(),
  execute: async () => {
    try {
      console.log("[DEBUG] getUsers: 開始");
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] getUsers: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/user`;

      console.log(`[DEBUG] getUsers: APIリクエストを開始します: ${url}`);
      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const validatedData = userResponseSchema.parse(data);

      // ユーザー一覧を整形して表示
      const formattedUsers = validatedData.map(user => ({
        userId: user.userId,
        userName: user.userName,
        email: user.email,
        group: user.group,
        retired: user.retired === 1 ? '退職済み' : '在職中',
        lastAccessed: user.lastAccessed || '未アクセス'
      }));

      return JSON.stringify(formattedUsers, null, 2);
    } catch (error) {
      console.error("[DEBUG] getUsers: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 