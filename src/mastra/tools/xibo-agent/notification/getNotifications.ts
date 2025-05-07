import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const notificationSchema = z.object({
  notificationId: z.number(),
  subject: z.string(),
  body: z.string(),
  createdDt: z.string(),
  releaseDt: z.string(),
  isEmail: z.number(),
  isInterrupt: z.number(),
  isSystem: z.number(),
  userId: z.number(),
  displayGroupIds: z.array(z.number()),
  displayGroupNames: z.array(z.string()),
  read: z.number(),
  readDt: z.string().nullable(),
  readBy: z.string().nullable()
});

// APIレスポンスのスキーマ
const responseSchema = z.array(notificationSchema);

export const getNotifications = createTool({
  id: 'get-notifications',
  description: '通知一覧を取得します',
  inputSchema: z.object({
    notificationId: z.number().optional().describe('通知IDでフィルタリング'),
    subject: z.string().optional().describe('件名でフィルタリング'),
    embed: z.string().optional().describe('関連データ（userGroups, displayGroups）を含めるかどうか')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] getNotifications: 開始");
      console.log("[DEBUG] getNotifications: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] getNotifications: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] getNotifications: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] getNotifications: 認証ヘッダーを取得しました");
      console.log("[DEBUG] getNotifications: 認証ヘッダー =", headers);

      console.log("[DEBUG] getNotifications: 検索条件 =", context);

      const queryParams = new URLSearchParams();
      if (context.notificationId) {
        queryParams.append('notificationId', context.notificationId.toString());
      }
      if (context.subject) {
        queryParams.append('subject', context.subject);
      }
      if (context.embed) {
        queryParams.append('embed', context.embed);
      }

      const url = `${config.cmsUrl}/api/notification?${queryParams.toString()}`;
      console.log(`[DEBUG] getNotifications: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      console.log(`[DEBUG] getNotifications: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getNotifications: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getNotifications: レスポンスデータを取得しました");
      console.log("[DEBUG] getNotifications: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = responseSchema.parse(data);
      console.log("[DEBUG] getNotifications: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getNotifications: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 