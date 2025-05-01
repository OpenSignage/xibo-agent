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

export const getUser = createTool({
  id: 'get-user',
  description: 'Xiboのユーザーの情報を取得します  ',
  inputSchema: z.object({
    userId: z.number().optional().describe('Filter by User Id'),
    userName: z.string().optional().describe('Filter by User Name'),
    userTypeId: z.number().optional().describe('Filter by UserType Id'),
    retired: z.number().optional().describe('Filter by Retired')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] getUser: 開始");
      console.log("[DEBUG] getUser: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] getUser: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] getUser: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] getUser: 認証ヘッダーを取得しました");
      console.log("[DEBUG] getUser: 認証ヘッダー =", headers);

      // クエリパラメータの構築
      const queryParams = new URLSearchParams();
      if (context.userId) queryParams.append('userId', context.userId.toString());
      if (context.userName) queryParams.append('userName', context.userName);
      if (context.userTypeId) queryParams.append('userTypeId', context.userTypeId.toString());
      if (context.retired) queryParams.append('retired', context.retired.toString());

      const queryString = queryParams.toString();
      const url = `${config.cmsUrl}/api/user${queryString ? `?${queryString}` : ''}`;

      console.log(`[DEBUG] getUser: APIリクエストを開始します: ${url}`);
      const response = await fetch(url, {
        headers,
      });

      console.log(`[DEBUG] getUser: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        console.error(`[DEBUG] getUser: HTTPエラーが発生しました: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getUser: レスポンスデータを取得しました");
      console.log("[DEBUG] getUser: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = userResponseSchema.parse(data);
      console.log("[DEBUG] getUser: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getUser: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
});