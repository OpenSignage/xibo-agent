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

const userResponseSchema = z.object({
  userId: z.number(),
  userName: z.string(),
  userTypeId: z.number(),
  loggedIn: z.string().nullable(),
  email: z.string(),
  homePageId: z.string(),
  homeFolderId: z.number(),
  lastAccessed: z.string(),
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
});

export const getUserMe = createTool({
  id: 'get-user-me',
  description: 'Xiboのユーザーである自分の情報を取得します  ',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('このツールは入力パラメータを必要としません')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] getUserMe: 開始");
      console.log("[DEBUG] getUserMe: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] getUserMe: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] getUserMe: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] getUserMe: 認証ヘッダーを取得しました");
      console.log("[DEBUG] getUserMe: 認証ヘッダー =", headers);

      console.log(`[DEBUG] getUserMe: APIリクエストを開始します: ${config.cmsUrl}/api/user/me`);
      const response = await fetch(`${config.cmsUrl}/api/user/me`, {
        headers,
      });

      console.log(`[DEBUG] getUserMe: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        console.error(`[DEBUG] getUserMe: HTTPエラーが発生しました: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getUserMe: レスポンスデータを取得しました");
      console.log("[DEBUG] getUserMe: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = userResponseSchema.parse(data);
      console.log("[DEBUG] getUserMe: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getUserMe: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
});